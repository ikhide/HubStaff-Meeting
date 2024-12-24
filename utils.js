const disallowedValues = [
  "[not provided]",
  "placeholder",
  "[[unknown]]",
  "not set",
  "not provided",
  "unknown",
  "undefined",
  "n/a",
];

const filterNullValuesFromObject = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(
      ([_, v]) =>
        v !== null &&
        v !== "" &&
        typeof v !== "undefined" &&
        (typeof v !== "string" ||
          !disallowedValues.includes(v.toLowerCase()) ||
          !v.toLowerCase().includes("!$record"))
    )
  );

const normalizePropertyName = (key) =>
  key
    .toLowerCase()
    .replace(/__c$/, "")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const generateLastModifiedDateFilter = (
  date,
  nowDate,
  propertyName = "hs_lastmodifieddate"
) => {
  const lastModifiedDateFilter = date
    ? {
        filters: [
          { propertyName, operator: "GTE", value: `${date.valueOf()}` },
          { propertyName, operator: "LTE", value: `${nowDate.valueOf()}` },
        ],
      }
    : {};

  return lastModifiedDateFilter;
};

async function retryOperation(operation, maxRetries = 4) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (new Date() > expirationDate) {
        await refreshAccessToken(domain, hubId);
      }
    }
  }
}

const goal = (actions) => {
  // this is where the data will be written to the database
  console.log(actions);
};

module.exports = {
  filterNullValuesFromObject,
  normalizePropertyName,
  generateLastModifiedDateFilter,
  goal,
  retryOperation,
};
