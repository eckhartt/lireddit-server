import { Updoot } from "../entities/Updoot";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { isAuth } from "../middleware/isAuth";
import postgresDataSource from "../typeorm.config";
import { MyContext } from "../types";

// Define fields we expect in input field PostInput
@InputType()
class PostInput {
  @Field()
  title!: string;
  @Field()
  text!: string;
}

// Define fields we expect in object PaginatedPosts
@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts!: Post[];
  @Field()
  hasMore!: boolean;
}

@Resolver(Post)
export class PostResolver {
  // textSnippet - provides graphql access to the first 50 characters of the text field on post
  //
  //
  @FieldResolver(() => String)
  textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50);
  }

  // Post voting
  //
  //
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx()
    { req }: MyContext
  ) {
    // If value is anything but -1, we consider it an updoot. Prevents malicious data
    const isUpdoot = value !== -1;
    // If isUpdoot is true, pass 1. Otherwise -1.
    const realValue = isUpdoot ? 1 : -1;
    // Grab userId from session
    const { userId } = req.session;
    // Checking if user has already voted on postId yet (and is thus on Updoot table)
    const updoot = await Updoot.findOne({ where: { postId, userId } });

    // if the user has voted on the post before and they are changing their vote
    if (updoot && updoot.value !== realValue) {
      await postgresDataSource.transaction(async (tm) => {
        await tm.query(
          `
    update updoot
    set value = $1
    where "postId" = $2 and "userId" = $3
          `,
          [realValue, postId, userId]
        );
        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
          `,
          [2 * realValue, postId]
        );
      });
    } else if (!updoot) {
      // else if user has never voted before
      await postgresDataSource.transaction(async (tm) => {
        await tm.query(
          `
    insert into updoot ("userId", "postId", value)
    values ($1, $2, $3);
          `,
          [userId, postId, realValue]
        );
        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
        `,
          [realValue, postId]
        );
      });
    }
    return true;
  }

  // QUERY all posts
  // Requires a limit (capped to 50). Accepts a cursor position using the datestamp of the post.
  // All posts before the cursor position, within the limit, are returned in createdAt descending order.
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null, // This will be the datestamp the post was created
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    // Check if limit provided is less than 50. If not, cap it at 50 results.
    const realLimit = Math.min(50, limit);
    //  +1 to enable us to check if there are more results available
    const realLimitPlusOne = realLimit + 1;

    // If cursor value is not null, modify query to filter posts that were created before that date value
    const replacements: any[] = [realLimitPlusOne]; //, req.session.userId];
    //
    // REVIEW NEXT IF STATEMENT - after fixing SSR cookie, DOES this need to be conditional?
    //
    if (req.session.userId) {
      replacements.push(req.session.userId);
    }

    let cursorIndex = 3;
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
      cursorIndex = replacements.length;
    }

    // Connect to postgres via typeorm and create a query
    const posts = await postgresDataSource.query(
      `
      select p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
        ) creator,
      ${
        req.session.userId
          ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
          : 'null as "voteStatus"'
      }
      from post p
      inner join public.user u on u.id = p."creatorId"
      ${cursor ? `where p."createdAt" < $${cursorIndex}` : ""}
      order by p."createdAt" DESC
      limit $1
      `,
      replacements
    );

    // Connect to postgres via typeorm and create a querybuilder
    // const qb = postgresDataSource
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy('"createdAt"', "DESC")
    //   .take(realLimitPlusOne);

    // If cursor value is not null, modify query to pull posts that were created before that date value
    // if (cursor) {
    //   qb.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    // }

    // Finish query and return results
    // const posts = await qb.getMany();
    return {
      // slice results so user recieves the requested number of posts
      posts: posts.slice(0, realLimit),
      // If there are more results available, passes true
      hasMore: posts.length === realLimitPlusOne,
    };
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
