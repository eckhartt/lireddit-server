import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { isAuth } from "../middleware/isAuth";
import postgresDataSource from "../typeorm.config";
import { MyContext } from "../types";

// Define fields we expect in type PostInput
@InputType()
class PostInput {
  @Field()
  title!: string;
  @Field()
  text!: string;
}

@Resolver(Post)
export class PostResolver {

  // textSnippet - provides graphql access to the first 50 characters of the text field on post
  @FieldResolver(() => String)
  textSnippet(
    @Root() root: Post
  ) {
    return root.text.slice(0,50);
  }


  // QUERY all posts
  // Requires a limit (capped to 50). Accepts a cursor position using the datestamp of the post.
  // All posts before the cursor position, within the limit, are returned in createdAt descending order.
  @Query(() => [Post])
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null // This will be the datestamp the post was created
  ): Promise<Post[]> {
    // Check if limit provided is less than 50. If not, cap it at 50 results.
    const realLimit = Math.min(50, limit);
    // Connect to postgres via typeorm and create a querybuilder
    const qb = postgresDataSource
      .getRepository(Post)
      .createQueryBuilder("p")
      .orderBy('"createdAt"', "DESC")
      .take(realLimit);
    // If cursor value is not null, modify query to pull posts that were created before that date
    if (cursor) {
      qb.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    }
    // Finish query and return results
    return qb.getMany();
  }

  // Graphql query 'post' accepts an id arg and will return either null Or the result for matching id of type Post
  //
  //
  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | null> {
    return Post.findOne({ where: { id } });
  }

  // Graphql mutation 'createPost' accepts a title arg and then em.create() a post entry
  //
  //
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
  }

  // Graphql mutation 'updatePost' accepts an id and title arg, checks if it can find the post with that id (else null) and then updates the post.title to the title provided
  //
  //
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne({ where: { id } });
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      await Post.update({ id }, { title });
    }
    return post;
  }

  // Graphql mutation 'deletePost' accepts an id and then em.nativeDelete() the post entry where matching id
  //
  //
  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }
}
