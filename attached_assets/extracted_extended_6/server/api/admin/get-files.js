module.exports = (req, res) => {
  res.json([
    { id: 1, name: "report_march.pdf", uploaded: "2025-11-01" },
    { id: 2, name: "letter_dispute.png", uploaded: "2025-11-10" }
  ]);
};