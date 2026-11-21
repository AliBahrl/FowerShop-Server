export default {
  routes: [
    {
      method: 'GET',
      path: '/dashboard/overview',
      handler: 'dashboard.overview',
      config: {
        policies: [],
      },
    },
  ],
};
