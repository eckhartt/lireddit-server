import { Entity, OptionalProps, PrimaryKey, Property } from "@mikro-orm/core";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class Post {

  [OptionalProps]?: 'createdAt' | 'updatedAt'; // Only 'title' will be required for `em.create()`. id is an optional prop by default. 

  @Field()
  @PrimaryKey({ type: "number" })
  id!: number;

  @Field(() => String)
  // @Property({ type: "date", onCreate: () => new Date() })
  @Property({ type: "date" })
  createdAt = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt = new Date();

  @Field()
  @Property({ type: "text" })
  title!: string;
}
