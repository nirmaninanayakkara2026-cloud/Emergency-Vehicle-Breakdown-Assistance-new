const mongoose = require("mongoose");

function transactionsUnavailable(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === 20 ||
    message.includes("transaction numbers are only allowed") ||
    message.includes("replica set") ||
    message.includes("transactions are not supported");
}

async function runWithOptionalTransaction(work) {
  if (mongoose.connection.readyState !== 1) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      if (!transactionsUnavailable(error)) throw error;
      return work(null);
    }
  } finally {
    await session.endSession();
  }
}

module.exports = { runWithOptionalTransaction, transactionsUnavailable };
