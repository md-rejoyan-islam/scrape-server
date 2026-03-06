export const healthCheck = (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
};
