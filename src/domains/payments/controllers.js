const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//const { sendEmail } = require("./emailController");
const { v4: uuidv4 } = require("uuid");
const User = require("../user/model");

function generateTransactionId() {
  return uuidv4();
}

function convertToUSD(price) {
  return price * 100;
}

async function handlePaymentSuccess(email) {
  try {
    const user = await User.findOne({ email });
    if (user) {
      user.paymentStatus = true;
      await user.save();
    }
  } catch (error) {
    console.error("Error in payment success:", error);
  }
}

module.exports = {
  createCheckoutSession: async (req, res) => {
    const { name, email, type, items } = req.body;
    const transactionId = generateTransactionId();

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.title,
          images: [
            "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTK_Qsmy_ahLnSY2XSCu5qdlVdrwSXqbXJx90XP42YXGIkeSnrj",
          ],
        },
        unit_amount: convertToUSD(item.price),
      },
      quantity: 1,
    }));

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${process.env.BASE_URL}?success=true&transaction_id=${transactionId}`,
        cancel_url: `${process.env.BASE_URL}/checkout?success=false&transaction_id=${transactionId}`,
        client_reference_id: transactionId,
        metadata: {
          name: name,
          email: email,
          type: type,
        },
      });

      res.json({ redirectUrl: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).send({ error: "Failed to create checkout session" });
    }
  },

  handleStripeWebhook: async (req, res) => {
    let event;

    try {
      const stripeSignature = req.headers["stripe-signature"];
      const rawBody = req.body;

      event = stripe.webhooks.constructEvent(
        rawBody,
        stripeSignature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Error verifying webhook signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed":
        console.log("checkout.session.completed");
        const session = event.data.object;
        if (session.mode === "payment") {
          try {
            lineItems = await stripe.checkout.sessions.listLineItems(
              session.id
            );
          } catch (error) {
            console.error("Error fetching line items:", error);
          }

          const { metadata } = session;
          // try {
          //   await sendEmail({
          //     name: metadata.name,
          //     email: metadata.email,
          //     type: metadata.type,
          //     items: lineItems.data,
          //   });
          // } catch (error) {
          //   console.error("Error sending email:", error);
          //   return res.status(500).send({ error: "Failed to send email" });
          // }

          console.log("payment");
        } else if (session.mode === "subscription") {
          const { email } = session.metadata;
          await handlePaymentSuccess(email);

          console.log("subscription");
        }

        let lineItems;

        break;
      case "invoice.payment_succeeded":
        console.log("invoice.payment_succeeded");

        break;
      case "invoice.payment_failed":
        console.log("invoice.payment_failed");

        break;
      case "customer.subscription.updated":
        console.log("customer.subscription.updated");
      // Додайте інші типи подій, які вам потрібні
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  },

  createSubscriptionCheckoutSession: async (req, res) => {
    const { lookupKey, email } = req.body;
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
    });

    try {
      price_id = prices["data"][0]["id"];

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: price_id,
            quantity: 1,
          },
        ],
        metadata: {
          email: email,
        },
        success_url: `${process.env.BASE_URL}/dashboard`,
        cancel_url: `${process.env.BASE_URL}/payment-plans`,
      });
      res.json({ redirectUrl: session.url });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  },
};
