// MongoDB Prisma: `deletedAt: null` only matches documents where the field
// exists and is null. Use this helper to also match documents where the field
// is missing (not yet set), which is the case for all newly created records.
export const notDeleted = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
}
