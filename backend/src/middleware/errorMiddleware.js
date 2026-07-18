function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = error.message || "Server error";

  if (error.code === 11000) {
    res.status(409);
    message = "Duplicate value already exists";
  }

  if (error.name === "ValidationError") {
    res.status(400);
    message = Object.values(error.errors)
      .map((item) => item.message)
      .join(". ");
  }

  if (error.name === "CastError") {
    res.status(400);
    message = "Invalid resource id";
  }

  res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : statusCode).json({
    success: false,
    message
  });
}

module.exports = {
  notFound,
  errorHandler
};
