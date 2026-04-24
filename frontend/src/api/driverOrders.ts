import { apiClient } from './client';

export const driverOrdersApi = {
  currentOffer: () =>
    apiClient.get('/driver/orders/current-offer').then(r => r.data),

  openOffer: (offerId: number) =>
    apiClient.post(`/driver/orders/offers/${offerId}/open`).then(r => r.data),

  acceptOffer: (offerId: number) =>
    apiClient.post(`/driver/orders/offers/${offerId}/accept`).then(r => r.data),

  ignoreOffer: (offerId: number) =>
    apiClient.post(`/driver/orders/offers/${offerId}/ignore`).then(r => r.data),

  activeOrders: () =>
    apiClient.get('/driver/orders/active').then(r => r.data),

  pickup: (orderId: number) =>
    apiClient.post(`/driver/orders/${orderId}/pickup`).then(r => r.data),

  complete: (orderId: number) =>
    apiClient.post(`/driver/orders/${orderId}/complete`).then(r => r.data),
};
