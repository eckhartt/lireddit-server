import {
  Field,
  InputType
} from "type-graphql";

// Create type for user/password input field

@InputType()
export class UsernamePasswordInput {
  @Field()
  email!: string;
  @Field()
  username!: string;
  @Field()
  password!: string;
}
