import { createResponse } from "../helper/helper.js";

const DEFAULT_CATEGORIES = [
  {
    categoryId: "1",
    categoryName: "Flight Booking",
    description: "Issues related to flight bookings and reservations",
    active: true
  },
  {
    categoryId: "2",
    categoryName: "Hotel Reservation",
    description: "Issues related to hotel bookings and accommodations",
    active: true
  },
  {
    categoryId: "3",
    categoryName: "Airport Transfer",
    description: "Issues related to airport transfers and car rentals",
    active: true
  },
  {
    categoryId: "4",
    categoryName: "Booking Modification",
    description: "Changes to existing bookings",
    active: true
  },
  {
    categoryId: "5",
    categoryName: "Cancellation",
    description: "Cancellation requests and refunds",
    active: true
  },
  {
    categoryId: "6",
    categoryName: "General Inquiry",
    description: "General questions and inquiries",
    active: true
  }
];

export const handler = async (event) => {
  console.log("Get Categories Event:", JSON.stringify(event, null, 2));

  try {
    // Return default categories
    // In a real implementation, you would fetch these from DynamoDB
    return createResponse(200, {
      success: true,
      data: DEFAULT_CATEGORIES
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return createResponse(500, {
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
};
