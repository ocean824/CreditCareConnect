module.exports = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });
  res.json({ message: `Reset link sent to ${email}` });
};