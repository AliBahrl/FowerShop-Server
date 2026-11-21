import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'legacy-support',
    },
  },

  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        baseUrl: env('SUPABASE_PUBLIC_URL'),
        s3Options: {
          credentials: {
            accessKeyId: env('SUPABASE_ACCESS_KEY'),
            secretAccessKey: env('SUPABASE_SECRET_KEY'),
          },
          region: env('SUPABASE_REGION'),
          endpoint: env('SUPABASE_ENDPOINT'),
          forcePathStyle: true,
          params: {
            Bucket: env('SUPABASE_BUCKET'),
            ACL: undefined,
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes: deniedExecutableTypes,
      },
    },
  },
});

export default config;