import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      "wardrobe-images": { access: "private" },
    },
  },
  auth: false,
  branch: (branch) => {
    if (branch.isDefault) {
      return {};
    }
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    return {};
  },
});
