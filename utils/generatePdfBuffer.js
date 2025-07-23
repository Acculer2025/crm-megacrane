const PDFDocument = require('pdfkit');

const generatePdfBuffer = (quotation) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    doc.fontSize(20).text('Quotation', { align: 'center' });
    doc.text(`Quotation #: ${quotation.quotationNumber}`);
    doc.text(`Customer: ${quotation.customerName}`);
    doc.text(`Business: ${quotation.businessName}`);
    doc.text(`Date: ${quotation.date}`);
    doc.text(`Valid Until: ${quotation.validUntil}`);

    quotation.items.forEach((item, i) => {
      doc.text(`${i + 1}. ${item.description} | Qty: ${item.quantity} | Rate: ${item.rate} | Total: ${item.quantity * item.rate}`);
    });

    doc.text(`SubTotal: ₹${quotation.subTotal}`);
    doc.text(`Tax: ₹${quotation.tax}`);
    doc.text(`Total: ₹${quotation.total}`);

    doc.end();
  });
};

module.exports = generatePdfBuffer;