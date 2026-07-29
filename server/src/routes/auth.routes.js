import {Router} from "express";
import {changeCurrentPassword, forgotPasswordRequest, getCurrentUser, login, logoutUser, refreshAccessToken, registerUser, resendEmailVerification, resetForgotPassword, verifyEmail} from "../controllers/auth.controllers.js";
import {loginAdminGate, getAdminGateStatus, logoutAdminGate} from "../controllers/adminGate.controllers.js";
import {validate} from "../middlewares/validator.middleware.js";
import {authLimiter} from "../middlewares/rateLimit.middleware.js";
import {userChangeCurrentPasswordValidator, userForgotPasswordValidator, userLoginValidator, userRegisterValidator, userResetForgotPasswordValidator, userVerifyEmailValidator} from "../validators/index.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";

const router = Router();

// unsecured route
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(authLimiter, userLoginValidator(), validate, login);
router.route("/verify-email").post(userVerifyEmailValidator(), validate, verifyEmail);
router.route("/refresh-token").post(refreshAccessToken);
router
  .route("/forgot-password")
  .post(userForgotPasswordValidator(), validate, forgotPasswordRequest);
router
  .route("/reset-password")
  .post(userResetForgotPasswordValidator(), validate, resetForgotPassword);

router.route("/admin-gate/login").post(authLimiter, loginAdminGate);
router.route("/admin-gate/status").get(getAdminGateStatus);
router.route("/admin-gate/logout").post(logoutAdminGate);

//secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router
  .route("/change-password")
  .post(
    verifyJWT,
    userChangeCurrentPasswordValidator(),
    validate,
    changeCurrentPassword,
  );
router
  .route("/resend-email-verification")
  .post(verifyJWT, resendEmailVerification);

export default router;
