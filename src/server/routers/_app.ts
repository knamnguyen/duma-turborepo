import { router } from "../trpc";
import { sessionRouter } from "./session";
import { postRouter } from "./post";
import { commentRouter } from "./comment";

export const appRouter = router({
  session: sessionRouter,
  post: postRouter,
  comment: commentRouter,
});

export type AppRouter = typeof appRouter;
