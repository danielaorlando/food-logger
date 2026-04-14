// Manual route tree — we have only 4 routes so we don't need the TanStack codegen.
// Add new routes here whenever you create a new route file.

import { Route as rootRoute } from "./__root";
import { Route as indexRoute } from "./index";
import { Route as loginRoute } from "./auth/login";
import { Route as addFoodRoute } from "./foods/add";
import { Route as foodsListRoute } from "./foods/index";
import { Route as diaryRoute } from "./diary/index";
import { Route as profileRoute } from "./profile/index";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  addFoodRoute,
  foodsListRoute,
  diaryRoute,
  profileRoute,
]);

export { routeTree };
