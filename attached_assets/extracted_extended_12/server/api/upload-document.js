module.exports = (req, res) => {
  const file = req.body.file;
  if (!file) return res.status(400).json({ message: "File is missing" });
  res.json({ message: "File uploaded successfully", file });
};