import Joi from 'joi';
import { Booking } from '../models/Booking.js';


const bookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().allow('').optional(),
  bookedBy: Joi.string().optional() // ObjectId arrives as a string in JSON
});


const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string()
}).min(1);


async function findConflict({ roomNumber, startDate, endDate, excludeId }) {
  const query = {
    roomNumber,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Booking.findOne(query);
}


export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ startDate: 1 })
      .populate('bookedBy', 'name email');
    res.json({ bookings });
  } catch (err) { next(err); }
}

export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}


export async function createBooking(req, res, next) {
  try {
    const { value, error } = bookingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await findConflict(value);
    if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing reservation' });

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}


export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });

    const roomNumber = value.roomNumber ?? existing.roomNumber;
    const startDate = value.startDate ?? existing.startDate;
    const endDate = value.endDate ?? existing.endDate;

   
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    const conflict = await findConflict({
      roomNumber,
      startDate,
      endDate,
      excludeId: existing._id
    });
    if (conflict) return res.status(409).json({ message: 'Booking conflicts with an existing reservation' });

    const doc = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('bookedBy', 'name email');

    res.json({ booking: doc });
  } catch (err) { next(err); }
}


export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}