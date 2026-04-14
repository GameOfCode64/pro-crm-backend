import * as service from "./auth.service.js";
import { validateLogin, validateCreateUser } from "./auth.validation.js";

export const login = async (req, res, next) => {
  try {
    const error = validateLogin(req.body);
    if (error) return res.status(400).json({ message: error });

    const data = await service.login(req.body);
    res.json(data);
  } catch (err) {
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message });
  }
};

export const createUser = async (req, res, next) => {
  try {
    const error = validateCreateUser(req.body);
    if (error) return res.status(400).json({ message: error });

    const user = await service.createUser(req.user, req.body);
    res.status(201).json(user);
  } catch (err) {
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message });
  }
};
