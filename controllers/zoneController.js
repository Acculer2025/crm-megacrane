// controllers/zoneController.js
const Zone = require('../models/Zone');

exports.getAllZones = async (req, res) => {
    try {
        const zones = await Zone.find();
        res.json(zones);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createZone = async (req, res) => {
    try {
        const newZone = new Zone(req.body);
        await newZone.save();
        res.status(201).json(newZone);
    } catch (err) {
        // Handle MongoDB duplicate key error (code 11000)
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Zone name already exists.' });
        }
        res.status(400).json({ error: err.message });
    }
};

exports.updateZone = async (req, res) => {
    try {
        const updatedZone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedZone) {
            return res.status(404).json({ message: 'Zone not found' });
        }
        res.json(updatedZone);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Zone name already exists.' });
        }
        res.status(400).json({ error: err.message });
    }
};

exports.deleteZone = async (req, res) => {
    try {
        const deletedZone = await Zone.findByIdAndDelete(req.params.id);
        if (!deletedZone) {
            return res.status(404).json({ message: 'Zone not found' });
        }
        res.json({ message: 'Zone deleted successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};