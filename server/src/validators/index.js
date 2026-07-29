import eventValidator from "./event.validator.js";
import incidentValidator from "./incident.validator.js";
import investigationValidator from "./investigation.validator.js";
import briefingValidator from "./briefing.validator.js";
import siteValidator from "./site.validator.js";
import { body } from "express-validator";

const userRegisterValidator = () => [
  body("email").isEmail(),
  body("username").isString().trim().notEmpty(),
  body("password").isString().isLength({ min: 8 }),
];

const userLoginValidator = () => [
  body("email").isEmail(),
  body("password").isString().notEmpty(),
];

const userForgotPasswordValidator = () => [body("email").isEmail()];

const userResetForgotPasswordValidator = () => [
  body("otp").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 8 }),
];

const userChangeCurrentPasswordValidator = () => [
  body("oldPassword").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 8 }),
];

const userVerifyEmailValidator = () => [body("otp").isString().trim().notEmpty()];

export {
  eventValidator,
  incidentValidator,
  investigationValidator,
  briefingValidator,
  siteValidator,
  userRegisterValidator,
  userLoginValidator,
  userForgotPasswordValidator,
  userResetForgotPasswordValidator,
  userChangeCurrentPasswordValidator,
  userVerifyEmailValidator,
};
