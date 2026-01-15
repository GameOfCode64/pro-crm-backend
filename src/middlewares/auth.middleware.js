import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 ALWAYS FETCH USER FROM DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        role: true,
        teamId: true,
        name: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User inactive or not found" });
    }

    // ✅ THIS IS THE FIX
    req.user = user;

    next();
  } catch (err) {
    next(err);
  }
}
