// Helper functions for cart operations

/**
 * Calculate cart subtotal
 */
export const calculateSubtotal = (cart) => {
  return cart.reduce(
    (sum, item) => sum + (item.sellPrice || 0) * (item.quantity || 1),
    0
  );
};

/**
 * Calculate cart profit
 */
export const calculateProfit = (cart) => {
  return cart.reduce((sum, item) => {
    const buy = Number(item.buyPrice || 0);
    const sell = Number(item.sellPrice || 0);
    const qty = Number(item.quantity || 1);
    return sum + (sell - buy) * qty;
  }, 0);
};

/**
 * Calculate final total with discount
 */
export const calculateFinalTotal = (subtotal, discount = 0) => {
  return Math.max(0, subtotal - discount);
};

/**
 * Prepare cart item data
 */
export const prepareCartItem = (product, options = {}) => {
  const isOffer = product.isOffer || false;
  // For offers, use the offer prices directly; for regular products, use options or product prices
  const sellPrice = isOffer 
    ? Number(product.sellPrice ?? 0)
    : Number(options.price ?? product.sellPrice ?? 0);
  const finalPrice = isOffer
    ? Number(product.finalPrice ?? 0)
    : Number(product.finalPrice ?? 0);

  return {
    name: product.name,
    sellPrice: sellPrice,
    productPrice: product.sellPrice,
    quantity: Number(options.quantity || 1),
    type: product.type || 'product',
    total: sellPrice * (Number(options.quantity || 1)),
    date: new Date(),
    color: options.color || '',
    size: options.size || '',
    originalProductId: product.id,
    code: product.code || '',
    buyPrice: product.buyPrice || 0,
    finalPrice: finalPrice,
    section: product.section || '',
    merchantName: product.merchantName || '',
    isOffer: isOffer, // Add flag to identify offer items
  };
};
