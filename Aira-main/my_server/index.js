const express = require('express');
const app = express();
const port = 3002;
const { MongoClient, ObjectId } = require('mongodb');
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require('bcrypt');
const saltRounds = 10;


app.use(morgan("combined"));

// Tăng giới hạn payload (50MB, bạn có thể thay đổi tùy theo nhu cầu)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.listen(port, () => {
  console.log(`My Server listening on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("This Web server is processed for MongoDB");
});

const client = new MongoClient("mongodb://127.0.0.1:27017");
client.connect();
const database = client.db("Aira");
const usersCollection = database.collection("Users");
const productsCollection = database.collection("Products");
const cartCollection = database.collection("Cart");
const checkoutCollection = database.collection("Checkout");


// Get all users
app.get("/users", cors(), async (req, res) => {
  const result = await usersCollection.find({}).toArray();
  res.send(result);
});

// Create new user
// Create new user
app.post("/users", cors(), async (req, res) => {
  try {
    // Check if email already exists
    const existingUser = await usersCollection.findOne({ Email: req.body.Email });
    if (existingUser) {
      return res.status(400).send({ error: "Email already registered" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.Password, saltRounds);

    // Replace plain password with hashed one
    const userWithHashedPassword = {
      ...req.body,
      Password: hashedPassword
    };

    // Put json User into database
    await usersCollection.insertOne(userWithHashedPassword);

    // Send message to client (don't send back the hashed password)
    const { Password, ...userWithoutPassword } = userWithHashedPassword;
    res.send(userWithoutPassword);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});
const jwt = require('jsonwebtoken');
const SECRET_KEY = "aira_demo_secret_key"; // Đủ dùng cho mục đích demo
// Middleware xác thực JWT
function verifyToken(req, res, next) {
  // Lấy header authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (!token) {
    return res.status(401).send({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  }

  try {
    const verified = jwt.verify(token, SECRET_KEY);
    req.user = verified; // Thêm thông tin user vào request
    next(); // Tiếp tục xử lý request
  } catch (error) {
    return res.status(403).send({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
}



// Login endpoint
app.post("/login", cors(), async (req, res) => {
  try {
    // Find user with matching email
    const { Email, Password } = req.body;

    // Validate input
    if (!Email || !Password) {
      return res.status(400).send({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await usersCollection.findOne({ Email: Email });

    // Check if user exists
    if (!user) {
      return res.status(401).send({ error: "Invalid email or password" });
    }

    // Compare hashed password
    const passwordMatch = await bcrypt.compare(Password, user.Password);

    if (!passwordMatch) {
      return res.status(401).send({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.Email },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { Password: userPassword, ...userWithoutPassword } = user;

    // Return user data with token
    res.status(200).send({
      message: "Login successful",
      user: userWithoutPassword,
      auth: {
        token: token
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// API Products
app.get("/products", async (req, res) => {
  const result = await productsCollection.find({}).toArray();
  res.send(result);
});

app.get("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    let query;
    if (ObjectId.isValid(productId)) {
      query = { _id: new ObjectId(productId) }; // Tìm theo ObjectId
    } else {
      query = { id: productId }; // Tìm theo 'id' dạng string như "SC001"
    }

    const result = await productsCollection.findOne(query);

    if (!result) {
      return res.status(404).send({ message: "Product not found" });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching product", error: error.message });
  }
});



// API Cart
app.get("/cart", async (req, res) => {
  const result = await cartCollection.find({}).toArray();
  res.send(result);
});

app.get("/cart/:cart_id", async (req, res) => {
  try {
    let cartId = req.params.cart_id;

    // Kiểm tra ID hợp lệ
    if (!ObjectId.isValid(cartId)) {
      return res.status(400).json({ error: "Invalid Cart ID" });
    }

    const cart = await cartCollection.findOne({ _id: new ObjectId(cartId) });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Lấy danh sách product_id từ giỏ hàng
    const productIds = cart.items.map(item => new ObjectId(item.product_id));

    // Lấy thông tin chi tiết sản phẩm từ collection Products
    const products = await productsCollection.find({ _id: { $in: productIds } }).toArray();

    // Kết hợp thông tin sản phẩm vào giỏ hàng
    const formattedCart = {
      cart_id: cart._id,
      items: cart.items.map(item => {
        const product = products.find(p => p._id.toString() === item.product_id);
        const discountValue = item.discount || 0;
        const originalPrice = product?.price || 0;
        const finalPrice = originalPrice * (1 - discountValue / 100);

        return {
          id: product?._id.toString() || item.product_id,
          name: product?.name || "Unknown Product",
          price: originalPrice,
          discount: discountValue,
          final_price: finalPrice.toFixed(2),
          total_price: finalPrice * item.quantity,
          quantity: item.quantity
        };
      })
    };

    res.send(formattedCart);
  } catch (error) {
    res.status(500).json({ error: "Error fetching cart", message: error.message });
  }
});

// API thêm vào giỏ hàng (yêu cầu đăng nhập)
// API thêm vào giỏ hàng (yêu cầu đăng nhập)
app.post("/cart", verifyToken, async (req, res) => {
  try {
    // Lấy ID người dùng từ token JWT
    const userId = req.user.userId;

    const { product_id, name, price, discount, image, quantity } = req.body;

    if (!product_id) {
      return res.status(400).send({ message: "Thiếu product_id" });
    }

    // Tính giá sau khi giảm giá
    const discountValue = discount || 0;
    const finalPrice = price * (1 - discountValue / 100);

    // Tìm giỏ hàng của người dùng
    const userCart = await cartCollection.findOne({ userId });

    if (userCart) {
      // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
      const productIndex = userCart.products.findIndex(
        p => p.product_id === product_id
      );

      if (productIndex > -1) {
        // Cập nhật quantity nếu sản phẩm đã tồn tại
        await cartCollection.updateOne(
          { userId, "products.product_id": product_id },
          {
            $inc: { "products.$.quantity": quantity },
            $set: { updatedAt: new Date() }
          }
        );
      } else {
        // Thêm sản phẩm mới vào giỏ hàng
        await cartCollection.updateOne(
          { userId },
          {
            $push: {
              products: {
                product_id,
                name,
                price,
                discount: discountValue,
                final_price: finalPrice.toFixed(2),
                image,
                quantity,
                addedAt: new Date()
              }
            },
            $set: { updatedAt: new Date() }
          }
        );
      }

      // Lấy giỏ hàng đã cập nhật để trả về
      const updatedCart = await cartCollection.findOne({ userId });
      res.status(200).send({
        message: "Thêm vào giỏ hàng thành công",
        cart: updatedCart
      });

    } else {
      // Tạo giỏ hàng mới nếu chưa tồn tại
      const newCart = {
        userId,
        products: [{
          product_id,
          name,
          price,
          discount: discountValue,
          final_price: finalPrice.toFixed(2),
          image,
          quantity,
          addedAt: new Date()
        }],
        updatedAt: new Date()
      };

      const result = await cartCollection.insertOne(newCart);
      res.status(201).send({
        message: "Tạo giỏ hàng mới thành công",
        cart: newCart
      });
    }
  } catch (error) {
    console.error("Lỗi khi thêm vào giỏ hàng:", error);
    res.status(500).send({
      message: "Lỗi khi thêm vào giỏ hàng",
      error: error.message
    });
  }
});
// API lấy giỏ hàng của người dùng đã đăng nhập
app.get("/user-cart", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Tìm giỏ hàng của người dùng
    const cart = await cartCollection.findOne({ userId });

    if (!cart) {
      // Trả về giỏ hàng trống nếu chưa tồn tại
      return res.send({
        userId,
        products: [],
        updatedAt: new Date()
      });
    }

    res.send(cart);
  } catch (error) {
    res.status(500).send({
      error: "Lỗi khi lấy giỏ hàng",
      message: error.message
    });
  }
});



// API cập nhật số lượng sản phẩm trong giỏ hàng
app.put("/cart/update", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { product_id, quantity } = req.body;

    if (!product_id) {
      return res.status(400).send({ message: "Thiếu product_id" });
    }

    // Kiểm tra xem giỏ hàng có tồn tại không
    const cart = await cartCollection.findOne({ userId });

    if (!cart) {
      return res.status(404).send({ message: "Không tìm thấy giỏ hàng" });
    }

    // Kiểm tra xem sản phẩm có trong giỏ hàng không
    const productExists = cart.products.some(p => p.product_id === product_id);

    if (!productExists) {
      return res.status(404).send({
        message: "Sản phẩm không tồn tại trong giỏ hàng"
      });
    }

    // Cập nhật số lượng
    await cartCollection.updateOne(
      { userId, "products.product_id": product_id },
      {
        $set: {
          "products.$.quantity": quantity,
          updatedAt: new Date()
        }
      }
    );

    // Lấy giỏ hàng đã cập nhật
    const updatedCart = await cartCollection.findOne({ userId });

    res.send({
      message: "Cập nhật số lượng thành công",
      cart: updatedCart
    });
  } catch (error) {
    res.status(500).send({
      error: "Lỗi khi cập nhật giỏ hàng",
      message: error.message
    });
  }
});

// API xóa sản phẩm khỏi giỏ hàng
app.delete("/cart/remove", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).send({ message: "Thiếu product_id" });
    }

    // Kiểm tra xem giỏ hàng có tồn tại không
    const cart = await cartCollection.findOne({ userId });

    if (!cart) {
      return res.status(404).send({ message: "Không tìm thấy giỏ hàng" });
    }

    // Xóa sản phẩm khỏi giỏ hàng
    await cartCollection.updateOne(
      { userId },
      {
        $pull: { products: { product_id } },
        $set: { updatedAt: new Date() }
      }
    );

    // Lấy giỏ hàng đã cập nhật
    const updatedCart = await cartCollection.findOne({ userId });

    res.send({
      message: "Đã xóa sản phẩm khỏi giỏ hàng",
      cart: updatedCart
    });
  } catch (error) {
    res.status(500).send({
      error: "Lỗi khi xóa sản phẩm khỏi giỏ hàng",
      message: error.message
    });
  }
});

// API lấy giỏ hàng chi tiết với thông tin sản phẩm đầy đủ
app.get("/cart/details", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Tìm giỏ hàng của người dùng
    const cart = await cartCollection.findOne({ userId });

    if (!cart || !cart.products || cart.products.length === 0) {
      return res.send({
        userId,
        products: [],
        subtotal: 0,
        total: 0
      });
    }

    // Tính tổng giá trị giỏ hàng
    let subtotal = 0;
    let total = 0;

    cart.products.forEach(product => {
      const productTotal = parseFloat(product.final_price) * product.quantity;
      subtotal += productTotal;
      total += productTotal;
    });

    res.send({
      ...cart,
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2)
    });
  } catch (error) {
    res.status(500).send({
      error: "Lỗi khi lấy chi tiết giỏ hàng",
      message: error.message
    });
  }
});
// API làm trống giỏ hàng
app.delete("/cart/clear", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Cập nhật giỏ hàng thành mảng rỗng
    await cartCollection.updateOne(
      { userId },
      {
        $set: {
          products: [],
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    res.send({ message: "Đã làm trống giỏ hàng" });
  } catch (error) {
    res.status(500).send({
      error: "Lỗi khi làm trống giỏ hàng",
      message: error.message
    });
  }
});
// API tạo checkout từ giỏ hàng
app.post("/checkout", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy thông tin giỏ hàng hiện tại
    const cart = await cartCollection.findOne({ userId });

    if (!cart || !cart.products || cart.products.length === 0) {
      return res.status(400).send({
        message: "Giỏ hàng trống, không thể tạo đơn hàng"
      });
    }

    // Tính tổng tiền
    let subtotal = 0;
    let total = 0;
    const shippingFee = 5.00; // Phí vận chuyển cố định

    cart.products.forEach(product => {
      const productTotal = parseFloat(product.final_price) * product.quantity;
      subtotal += productTotal;
    });

    total = subtotal + shippingFee;

    // Tạo đối tượng checkout mới
    // Thay vì tạo checkoutId mới, hãy sử dụng _id mặc định của MongoDB
    const checkout = {
      userId,
      checkoutDate: new Date(),
      products: cart.products,
      subtotal: subtotal.toFixed(2),
      shippingFee: shippingFee.toFixed(2),
      total: total.toFixed(2),

    };

    // Lưu vào collection Checkout
    const result = await checkoutCollection.insertOne(checkout);

    res.status(201).send({
      message: "Tạo đơn hàng thành công",
      checkoutId: result.insertedId, // Sử dụng ID được tạo bởi MongoDB
      checkout
    });
  } catch (error) {
    console.error("Lỗi khi tạo đơn hàng:", error);
    res.status(500).send({
      message: "Lỗi khi tạo đơn hàng",
      error: error.message
    });
  }
});

// API lấy thông tin checkout theo ID
app.get("/checkout/:checkoutId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const checkoutId = req.params.checkoutId;
    console.log("User ID từ token:", userId);
    console.log("Checkout ID từ params:", checkoutId);

    if (!ObjectId.isValid(checkoutId)) {
      return res.status(400).send({ message: "ID đơn hàng không hợp lệ" });
    }

    // Tìm checkout theo _id và userId
    const checkout = await checkoutCollection.findOne({
      _id: new ObjectId(checkoutId),  // Thay đổi từ checkoutId sang _id
      userId
    });

    if (!checkout) {
      return res.status(404).send({ message: "Không tìm thấy đơn hàng" });
    }

    res.send(checkout);
  } catch (error) {
    res.status(500).send({
      message: "Lỗi khi lấy thông tin đơn hàng",
      error: error.message
    });
  }
});

// Add this to your existing server.js file



const ordersCollection = database.collection("Orders");

// API to get user profile
// In your server.js file
app.get("/users/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find user by ID
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Log the user data to see the actual structure
    console.log("User data from database:", user);

    // Remove sensitive information
    const { Password, ...userProfile } = user;

    res.send(userProfile);
  } catch (error) {
    res.status(500).send({
      error: "Error fetching user profile",
      message: error.message
    });
  }
});

// API to create a new order
app.post("/orders", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orderData = req.body;

    // Validate required fields
    if (!orderData.shippingInfo || !orderData.paymentMethod || !orderData.orderSummary) {
      return res.status(400).send({ message: "Missing required order information" });
    }

    // Create order object
    const order = {
      userId,
      checkoutId: orderData.checkoutId,
      shippingInfo: orderData.shippingInfo,
      paymentMethod: orderData.paymentMethod,
      orderSummary: orderData.orderSummary,
      orderDate: new Date(),
      status: "pending"
    };

    // Insert order into database
    const result = await ordersCollection.insertOne(order);

    // Clear the user's cart if order is successful
    if (result.insertedId) {
      await cartCollection.updateOne(
        { userId },
        { $set: { products: [], updatedAt: new Date() } },
        { upsert: true }
      );

      // Update checkout status
      await checkoutCollection.updateOne(
        { _id: new ObjectId(orderData.checkoutId) },
        { $set: { status: "ordered" } }
      );
    }

    res.status(201).send({
      message: "Order created successfully",
      orderId: result.insertedId
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send({
      message: "Error creating order",
      error: error.message
    });
  }
});

// API to get user's orders
app.get("/orders", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all orders for the user
    const orders = await ordersCollection.find({ userId }).toArray();

    res.send(orders);
  } catch (error) {
    res.status(500).send({
      message: "Error fetching orders",
      error: error.message
    });
  }
});

// API to get a specific order
app.get("/orders/:orderId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.orderId;

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).send({ message: "Invalid order ID" });
    }

    // Find order by ID and user ID
    if (!ObjectId.isValid(orderId)) {
      return res.status(400).send({ message: "Invalid order ID" });
    }

    const order = await ordersCollection.findOne({
      _id: new ObjectId(orderId),
      userId
    });


    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }

    res.send(order);
  } catch (error) {
    res.status(500).send({
      message: "Error fetching order",
      error: error.message
    });
  }
});