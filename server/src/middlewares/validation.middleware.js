const formatJoiErrors = (error) =>
  error.details.map((detail) => ({
    field: detail.path.join("."),
    message: detail.message,
  }));

const sendValidationError = (res, errors) =>
  res.status(400).json({
    success: false,
    statusCode: 400,
    message: "Validation Error",
    errors,
  });

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const target =
      source === "query" ? req.query : source === "params" ? req.params : req.body;

    const { error, value } = schema.validate(target, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return sendValidationError(res, formatJoiErrors(error));
    }

    if (source === "body") {
      req.validatedData = value;
      req.body = value;
    } else if (source === "query") {
      req.query = value;
    } else {
      req.params = value;
    }

    next();
  };
};

export default validate;
