const express = require('express');
const router = express.Router();

router.post('/demo-eval', (req, res) => {
  const result = eval(req.body.expr);
  res.json({ result });
});

module.exports = router;
