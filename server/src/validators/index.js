import eventValidator from "./event.validator.js";
import incidentValidator from "./incident.validator.js";
import investigationValidator from "./investigation.validator.js";
import briefingValidator from "./briefing.validator.js";
import reviewValidator from "./review.validator.js";
import { body, param } from "express-validator";

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
  param("resetToken").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 8 }),
];

const userChangeCurrentPasswordValidator = () => [
  body("oldPassword").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 8 }),
];

export {
  eventValidator,
  incidentValidator,
  investigationValidator,
  briefingValidator,
  reviewValidator,
  userRegisterValidator,
  userLoginValidator,
  userForgotPasswordValidator,
  userResetForgotPasswordValidator,
  userChangeCurrentPasswordValidator,
};
