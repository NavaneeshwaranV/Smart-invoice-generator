export const errorHandler = (err, req, res, next) => {
  console.error('[API Error]', err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages[0] || 'Validation failed',
      errors: messages,
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A record with this unique identifier (e.g., Invoice Number) already exists.',
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  });
};
