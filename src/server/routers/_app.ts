import { router } from "../trpc";
import { sessionRouter } from "./session";
import { postRouter } from "./post";
import { commentRouter } from "./comment";
import { userRouter } from "./user";
import { mediaRouter } from "./media";

export const appRouter = router({
  session: sessionRouter,
  post: postRouter,
  comment: commentRouter,
  user: userRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
