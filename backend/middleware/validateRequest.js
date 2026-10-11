export const validateRequest = (validatorFn) => {
  return (req, res, next) => {
    const errors = validatorFn(req.body);
    if (Array.isArray(errors) && errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }
    next();
  };
};
