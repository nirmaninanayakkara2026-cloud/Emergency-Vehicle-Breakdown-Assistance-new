const APPROVED_PROVIDER_QUERY = Object.freeze({ approvalStatus: "approved" });

function isProviderApproved(profile) {
  if (!profile) return false;
  return profile.approvalStatus === "approved";
}

module.exports = { APPROVED_PROVIDER_QUERY, isProviderApproved };
