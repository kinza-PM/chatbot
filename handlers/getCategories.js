import { createResponse } from "../helper/helper.js";

const DEFAULT_CATEGORIES = [
  {
    categoryId: "1",
    categoryName: "Booking Issues",
    description: "Issues related to flight, hotel, or transport bookings",
    active: true
  },
  {
    categoryId: "2",
    categoryName: "Refund Request",
    description: "Request for refund or cancellation",
    active: true
  },
  {
    categoryId: "3",
    categoryName: "Technical Support",
    description: "Technical issues with the website or app",
    active: true
  },
  {
    categoryId: "4",
    categoryName: "General Inquiry",
    description: "General questions or inquiries",
    active: true
  },
  {
    categoryId: "5",
    categoryName: "Other",
    description: "Other issues not listed above",
    active: true
  }
];

export const handler = async (event) => {
  console.log("Get Categories Event:", JSON.stringify(event, null, 2));

  try {
    // Fetch categories from MasterListing API
    const endpoint = `${process.env.MASTERLISTING_API_BASE}/getListingData?tableName=ticket-reasons`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();

      if (result.items && Array.isArray(result.items)) {
        // Transform reasons to category format
        const categories = result.items
          .filter(reason => reason.status === true)
          .map(reason => ({
            categoryId: reason.id,
            categoryName: reason.reason,
            description: `Support category: ${reason.reason}`,
            active: reason.status
          }));

        return createResponse(200, {
          success: true,
          data: categories
        });
      }
    }

    return createResponse(500, {
      success: false,
      message: "Failed to fetch categories from database"
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
