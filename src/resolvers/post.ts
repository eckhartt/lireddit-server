import { Post } from "../entities/Post";
// import { MyContext } from "../types";
import { Resolver, Query, Arg, Mutation } from "type-graphql";

@Resolver()
export class PostResolver {
  // Graphql query 'posts' will return all results for type Post
  @Query(() => [Post])
  async posts(): Promise<Post[]> {
    return Post.find();
  }

  // Graphql query 'post' accepts an id arg and will return either null Or the result for matching id of type Post
  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | null> {
    console.log(`id is`,id);
    return Post.findOne({where: {id} });
  }

  // Graphql mutation 'createPost' accepts a title arg and then em.create() a post entry
  @Mutation(() => Post)
  async createPost(@Arg("title") title: string): Promise<Post> {
    // This performs 2 sql queries, one to create and one to select and return
    return Post.create({ title }).save();
  }

  // Graphql mutation 'updatePost' accepts an id and title arg, checks if it can find the post with that id (else null) and then updates the post.title to the title provided
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne({where: {id}});
    if (!post) {
      return null;
    }
    if (typeof title !== "undefined") {
      await Post.update({ id }, { title });
    }
    return post;
  }

  // Graphql mutation 'deletePost' accepts an id and then em.nativeDelete() the post entry where matching id
  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }
}
