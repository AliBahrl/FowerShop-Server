import type { Context } from 'koa';

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface OrderEntity {
  id: number;
  total: number;
  stat: 'Processing' | 'Delivered' | 'Cancelled';
  items: OrderItem[];
  createdAt: string;
}

interface ProductEntity {
  id: number;
  name: string;
  stock?: number;
  category?: { name: string } | null;
}

interface FavouriteEntity {
  id: number;
  userId: number;
  product?: { name: string } | null;
}

interface FeedbackEntity {
  id: number;
  name: string;
  rating: number;
  message: string;
  publishedAt: string | null;
  createdAt: string;
}

interface VisitEntity {
  id: number;
  createdAt: string;
}

export default {
  async overview(ctx: Context) {
    const orders: OrderEntity[] = await strapi.db.query('api::order.order').findMany({
      orderBy: { createdAt: 'desc' },
    });
    const products: ProductEntity[] = await strapi.db.query('api::product.product').findMany({
      populate: ['category'],
    });
    const favourites: FavouriteEntity[] = await strapi.db.query('api::favourite.favourite').findMany({
      populate: ['product'],
    });
    // only approved (published) feedback counts for rating / latest feedback
    const feedbacks: FeedbackEntity[] = await strapi.db.query('api::feedback.feedback').findMany({
      where: { publishedAt: { $notNull: true } },
      orderBy: { createdAt: 'desc' },
    });
    const totalFeedbackSubmitted: number = await strapi.db.query('api::feedback.feedback').count();
    const visits: VisitEntity[] = await strapi.db.query('api::visit.visit').findMany();
    const totalUsers: number = await strapi.db.query('plugin::users-permissions.user').count();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const sum = (arr: OrderEntity[]) => arr.reduce((s, o) => s + (o.total || 0), 0);

    // ---- sales + change vs last week ----
    const thisWeekOrders = orders.filter((o) => new Date(o.createdAt) >= weekAgo);
    const lastWeekOrders = orders.filter(
      (o) => new Date(o.createdAt) >= twoWeeksAgo && new Date(o.createdAt) < weekAgo
    );
    const totalSales = sum(orders);
    const thisWeekSales = sum(thisWeekOrders);
    const lastWeekSales = sum(lastWeekOrders);
    const salesChangePct = lastWeekSales
      ? Math.round(((thisWeekSales - lastWeekSales) / lastWeekSales) * 100)
      : 0;

    // ---- sales for the last 7 days, per day ----
    const salesByDay = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().slice(0, 10);
      const total = orders
        .filter((o) => o.createdAt.slice(0, 10) === dayStr)
        .reduce((s, o) => s + (o.total || 0), 0);
      return { day: day.toLocaleDateString('en-US', { weekday: 'short' }), total };
    });

    // ---- visits + change vs last week ----
    const thisWeekVisits = visits.filter((v) => new Date(v.createdAt) >= weekAgo).length;
    const lastWeekVisits = visits.filter(
      (v) => new Date(v.createdAt) >= twoWeeksAgo && new Date(v.createdAt) < weekAgo
    ).length;
    const visitsChangePct = lastWeekVisits
      ? Math.round(((thisWeekVisits - lastWeekVisits) / lastWeekVisits) * 100)
      : 0;

    // ---- order status breakdown ----
    const statusCounts: Record<string, number> = orders.reduce((acc, o) => {
      acc[o.stat] = (acc[o.stat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ---- product sales + category sales, from items JSON snapshots ----
    const productSales: Record<number, number> = {};
    const categorySales: Record<string, number> = {};
    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        productSales[item.id] = (productSales[item.id] || 0) + item.quantity;
        const product = products.find((p) => p.id === item.id);
        const catName = product?.category?.name || 'Other';
        categorySales[catName] = (categorySales[catName] || 0) + item.price * item.quantity;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([id, qty]) => ({
        name: products.find((p) => p.id === Number(id))?.name || 'Unknown',
        sold: qty,
      }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    const topCategoriesBySales = Object.entries(categorySales)
      .map(([name, total]) => ({ name, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // ---- top favourited products ----
    const favCounts: Record<string, number> = {};
    favourites.forEach((f) => {
      const name = f.product?.name || 'Unknown';
      favCounts[name] = (favCounts[name] || 0) + 1;
    });
    const topFavourites = Object.entries(favCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ---- low stock ----
    const lowStockCount = products.filter((p) => (p.stock ?? 0) < 5).length;

    // ---- avg order value ----
    const avgOrderValue = orders.length ? Math.round(totalSales / orders.length) : 0;

    // ---- rating & feedback (approved / published only) ----
    const avgRating = feedbacks.length
      ? Number((feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.length).toFixed(1))
      : 0;
    const latestFeedback = feedbacks.slice(0, 2).map((f) => ({
      name: f.name,
      rating: f.rating,
      message: f.message,
    }));

    // ---- recent orders ----
    const recentOrders = orders.slice(0, 5).map((o) => ({
      id: o.id,
      total: o.total,
      stat: o.stat,
      createdAt: o.createdAt,
    }));

    ctx.body = {
      totalSales,
      salesChangePct,
      salesByDay,
      visits: thisWeekVisits,
      visitsChangePct,
      totalProducts: products.length,
      lowStockCount,
      totalUsers,
      statusCounts,
      topProducts,
      topCategoriesBySales,
      topFavourites,
      avgOrderValue,
      avgRating,
      totalFeedback: totalFeedbackSubmitted,
      latestFeedback,
      recentOrders,
    };
  },
};
