import { Field, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@ObjectType()
@Entity()
// Extending BaseEntity to give access to Post.find, Post.insert etc.
export class Post extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Field(() => String)
  @CreateDateColumn()
  createdAt!: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt!: Date;

  @Field()
  @Column()
  title!: string;
}
