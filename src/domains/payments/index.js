const express = require("express");
const routes = express.Router();

const {
  handleStripeWebhook,
  createCheckoutSession,
  createSubscriptionCheckoutSession,
} = require("./controllers");

routes.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);
routes.post("/create-checkout-session", createCheckoutSession);
routes.post(
  "/create-subscription-checkout-session",
  createSubscriptionCheckoutSession
);

module.exports = routes;