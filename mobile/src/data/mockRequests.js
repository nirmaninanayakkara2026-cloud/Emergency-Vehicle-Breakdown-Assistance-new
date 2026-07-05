export const mockRequests = [
  {
    id: "R-1001",
    driverName: "Demo Driver",
    driverPhone: "0771002003",
    vehicleType: "car",
    vehicleModel: "Toyota Aqua",
    breakdownType: "battery_issue",
    urgencyLevel: "medium",
    problemDescription: "Vehicle will not start",
    currentLocation: {
      latitude: 6.9271,
      longitude: 79.8612,
      address: "Colombo, Sri Lanka"
    },
    status: "Accepted",
    distanceKm: 2.1,
    providerName: "City Auto Mechanics",
    providerPhone: "0771234567",
    eta: "15 min"
  },
  {
    id: "R-1002",
    driverName: "Nimal Perera",
    driverPhone: "0713344556",
    vehicleType: "van",
    vehicleModel: "Nissan Caravan",
    breakdownType: "flat_tyre",
    urgencyLevel: "low",
    problemDescription: "Flat tyre",
    currentLocation: {
      latitude: 6.9271,
      longitude: 79.8612,
      address: "Colombo, Sri Lanka"
    },
    status: "Pending",
    distanceKm: 3.7,
    providerName: null,
    providerPhone: null,
    eta: null
  },
  {
    id: "R-1003",
    driverName: "Sahan Silva",
    driverPhone: "0758881234",
    vehicleType: "bike",
    vehicleModel: "",
    breakdownType: "battery_issue",
    urgencyLevel: "high",
    problemDescription: "Battery problem",
    currentLocation: {
      latitude: 6.9271,
      longitude: 79.8612,
      address: "Colombo, Sri Lanka"
    },
    status: "On the way",
    distanceKm: 1.8,
    providerName: "Quick Tow Colombo",
    providerPhone: "0779876543",
    eta: "8 min"
  }
];
