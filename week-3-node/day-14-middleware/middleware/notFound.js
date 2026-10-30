function notFound(req, res, next) {
    const error = new Error("Route not found")
    error.status = 400
    next(error);
}
module.exports = notFound;