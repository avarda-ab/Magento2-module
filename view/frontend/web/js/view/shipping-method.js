/**
 * @copyright Copyright © 2021 Avarda. All rights reserved.
 * @package   Avarda_Checkout
 */
define([
    'jquery',
    'ko',
    'Magento_Checkout/js/view/shipping',
    'Magento_Checkout/js/action/set-shipping-information',
    'Magento_Checkout/js/action/select-shipping-method',
    'Magento_Checkout/js/checkout-data',
    'Magento_Checkout/js/model/shipping-rate-service',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/model/url-builder',
    'mage/storage',
    "Magento_Checkout/js/model/payment-service",
    "Magento_Checkout/js/model/error-processor",
    'Magento_Customer/js/model/customer',
    'mage/translate'
], function (
    $,
    ko,
    Component,
    setShippingInformationAction,
    selectShippingMethodAction,
    checkoutData,
    shippingRateService,
    quote,
    urlBuilder,
    storage,
    paymentService,
    errorProcessor,
    customer,
) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Avarda_Checkout/shipping-method'
        },
        initialize: function () {
            let self = this;
            this._super();

            if (quote.isVirtual()) {
                self.initializeIframe();
            }

            // This is needed when shippingMethod is already selected, but it's not available right away
            let initial = quote.shippingMethod.subscribe(function(){
                setShippingInformationAction();
                // remove this subscription
                initial.dispose();
            });

            /**
             * Listener for quote totals changes
             * Triggers iframe initialization when totals change
             */
            quote.totals.subscribe(function () {
                if (quote.shippingMethod() || quote.isVirtual()) {
                    self.initializeIframe();
                }
            });
        },

        selectShippingMethod: function (shippingMethod) {
            let currentMethod = quote.shippingMethod();
            selectShippingMethodAction(shippingMethod);
            checkoutData.setSelectedShippingRate(shippingMethod['carrier_code'] + '_' + shippingMethod['method_code']);

            // Save selection, but not on first save, because selectShippingMethodAction will save it if it's not before set
            if (currentMethod) {
                setShippingInformationAction();
            }
            return true;
        },

        /**
         * Update hook when changing different shipping address inside iframe
         *
         * @param result
         * @param customerInfo
         */
        updateShippingAddressHook: function (result, customerInfo) {
            result.continue();
        },

        /**
         * Before redirecting away from the checkout page
         * is called right before the Check-Out is completed.
         * This function must call result.continue() or result.cancel() function.
         *
         * @param result
         * @param purchaseId
         * @param paymentMethod
         */
        beforeCompleteHook: function (result, purchaseId, paymentMethod) {
            if (quote.shippingMethod() || quote.isVirtual()) {
                let serviceUrl = '';
                if (customer.isLoggedIn()) {
                    serviceUrl = urlBuilder.createUrl('/carts/mine/avarda-payment', {});
                } else {
                    serviceUrl = urlBuilder.createUrl('/guest-carts/:cartId/avarda-payment', {
                        cartId: quote.getQuoteId()
                    });
                }
                storage.post(
                    serviceUrl, []
                ).done(function () {
                    result.continue();
                }).fail(function (response) {
                    result.cancel(response);
                });
            } else {
                result.cancel($.mage.__("Missing shipping method. Please select the shipping method and try again."));
            }
        },

        /**
         * Initializes checkout iframe
         *
         * @returns {boolean}
         */
        initializeIframe: function() {
            let self = this;
            let serviceUrl = '';

            if (customer.isLoggedIn()) {
                serviceUrl = urlBuilder.createUrl('/carts/mine/avarda-payment', {});
            } else {
                serviceUrl = urlBuilder.createUrl('/guest-carts/:cartId/avarda-payment', {
                    cartId: quote.getQuoteId()
                });
            }

            storage.get(
                serviceUrl, true
            ).done(function (response) {
                // Initialize is needed only if purchaseId changes
                if (options.purchaseId !== response.purchase_id) {
                    $('#mainiFrame, #avardaCheckOutLoadingSpinner').remove();
                    options.purchaseId = response.purchase_id;
                    options.callbackUrl = options.callbackUrlBase + response.purchase_id;
                    options.updateDeliveryAddressHook = self.updateShippingAddressHook;
                    options.beforeCompleteHook = self.beforeCompleteHook;

                    // Reinitialize checkout iframe
                    AvardaCheckOutClient.init(options);
                } else {
                    // Update items to update visible price
                    AvardaCheckOutClient.updateItems();
                }
            }).fail(function (response) {
                errorProcessor.process(response);
            });

            return true;
        }
    });
});
