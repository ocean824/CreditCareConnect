module.exports = (req, res) => {
  res.json([
    { id: 1, name: "John Doe", email: "user@domain.com", tier: "Premium" },
    { id: 2, name: "Jane Smith", email: "jane@demo.com", tier: "Basic" }
  ]);
};