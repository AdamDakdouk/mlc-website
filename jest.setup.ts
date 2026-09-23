process.env.MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mlc-test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret-please-override-in-real-env-xyz";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@test.local";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "test-password-123";
