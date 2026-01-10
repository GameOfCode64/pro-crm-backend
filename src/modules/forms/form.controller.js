import * as service from "./form.service.js";

export const createForm = async (req, res, next) => {
  try {
    const form = await service.createForm(req.user, req.body);
    res.status(201).json(form);
  } catch (e) {
    next(e);
  }
};

export const getForms = async (req, res, next) => {
  try {
    const forms = await service.getForms(req.user.teamId);
    res.json(forms);
  } catch (e) {
    next(e);
  }
};

export const getFormById = async (req, res, next) => {
  try {
    const form = await service.getFormById(req.params.formId);
    res.json(form);
  } catch (e) {
    next(e);
  }
};

export const getLeadForms = async (req, res, next) => {
  try {
    const data = await service.getLeadForms(req.params.leadId);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const submitForm = async (req, res, next) => {
  try {
    const data = await service.submitForm({
      user: req.user,
      formId: req.params.formId,
      leadId: req.params.leadId,
      values: req.body,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};
