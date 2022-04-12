import { User } from "../entities/User";
import { MyContext } from "../types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PASSWORDS_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
// import postgresDataSource from "../typeorm.config";

// Create type for error messages
@ObjectType()
class FieldError {
  @Field()
  field!: string;
  @Field()
  message!: string;
}

// Create type that will return from Register and Login mutations
@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {
  
  // Restrict user.email queries to only return for current user 
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    // this is the current user and its ok to show them their own email
    if (req.session.userId === user.id) {
      return user.email;
    }
    // current user wants to see someone elses email
    return "";
  }

  // Change password mutation
  //
  //
  @Mutation(() => UserResponse)
  async ChangePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "length must be greater than 3",
          },
        ],
      };
    }

    const key = FORGET_PASSWORDS_PREFIX + token;
    const userId = await redis.get(key);

    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired",
          },
        ],
      };
    }
    // Redis stores values as strings, so we convert id to int
    const userIdInt = parseInt(userId);
    const user = await User.findOne({ where: { id: userIdInt } });

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }
    // Hash user password
    // user.password = await argon2.hash(newPassword);
    // Push hashed password to database
    // await em.persistAndFlush(user);
    await User.update(
      { id: userIdInt },
      {
        password: await argon2.hash(newPassword),
      }
    );
    // Delete forgotten pasword token
    await redis.del(key);
    // Log in user
    req.session.userId = user.id;

    return { user };
  }

  // Forgotten password mutation
  //
  //
  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // email not in db - returning true to prevent abuse
      return true;
    }

    // Generate token with uuid
    const token = v4();
    // Store token in redis to expire after 3days
    await redis.set(
      FORGET_PASSWORDS_PREFIX + token,
      user.id,
      "EX",
      1000 * 60 * 60 * 24 * 3
    );
    // Email user with reset password link
    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );
    return true;
  }

  // Current user query
  //
  //
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    // you are not logged in
    if (!req.session.userId) {
      return null;
    }
    return User.findOne({ where: { id: req.session.userId } });
  }

  // Register mutation
  //
  //
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);

    let user;
    try {
      // Below is the longer query builder method
      // const result = await postgresDataSource
      //   .createQueryBuilder()
      //   .insert()
      //   .into(User)
      //   .values({
      //     username: options.username,
      //     email: options.email,
      //     password: hashedPassword,
      //   })
      //   .returning("*")
      //   .execute();
      // user = result.raw[0];

      // Alternatively we could do User.create({ username:..., email:..}).save();
      const result = await User.create({
        username: options.username,
        email: options.email,
        password: hashedPassword,
      }).save();

      user = result;
    } catch (err: any) {
      // Duplicate username error
      if (err.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "username already taken",
            },
          ],
        };
      }
    }

    // store user id session
    if (user) {
      req.session.userId = user.id;
    }

    return { user };
  }

  // Login mutation
  // Accepts argument 'options' of the type UsernamePasswordInput and performs findOne against that data.
  // If the user is not found `user` will be null and a user does not exist error is returned.
  // If the user is found, the password hash will be verified with argon2. If incorrect, error returns. Else user.id is stored in redis session.
  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "that username doesn't exist",
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password",
          },
        ],
      };
    }

    console.log(`user.id: `, user.id);
    req.session.userId = user.id;
    console.log('req.session.userId: ',req.session.userId);

    return {
      user,
    };
  }

  // Logout mutation
  // Creates promise to wait for the req.session.destroy callback to return
  // confirming whether redis session has been destroyed and returns true where successful.
  // Browser cookie is cleared whether session.destroy is successful or not
  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }
}
