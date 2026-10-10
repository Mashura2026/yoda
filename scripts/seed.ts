import { getDb } from "../src/db/client";
import { seedPrograms } from "../src/db/seed";

seedPrograms(getDb() as never).then(() => {
  console.log("seeded");
  process.exit(0);
});
