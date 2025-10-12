# Mock ECS UI - Local Docker Container Management

A React-based web application that provides a local interface for managing Docker containers, designed to simulate AWS ECS (Elastic Container Service) functionality. This tool allows you to manage Docker containers locally while providing an ECS-like experience for development and testing.

## 🎯 Project Purpose

This application serves as a **local development environment** that mimics AWS ECS behavior using Docker containers. It's particularly useful for:

- **Learning ECS concepts** without AWS costs
- **Testing container orchestration** locally
- **Developing ECS-like workflows** before deploying to AWS
- **Understanding container management** in a familiar web interface

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   CORS Proxy    │    │   Docker API    │
│   (Port 5173)   │◄──►│   (Port 2376)   │◄──►│   (Port 2375)   │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • CORS Headers  │    │ • Container API │
│ • Task Mgmt     │    │ • Request Proxy │    │ • Stats API     │
│ • Task Mgmt     │    │ • Error Handling│    │ • Stats API     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🐳 Docker Setup

### Prerequisites

- **Docker Desktop** installed and running
- **Node.js 18+** and npm installed
- **Docker API** exposed on port 2375

### Step 1: Expose Docker API

Docker Desktop doesn't expose the API by default. You need to enable it:

#### Option A: Docker Desktop Settings (Recommended)
1. Open Docker Desktop
2. Go to **Settings** → **General**
3. Check **"Expose daemon on tcp://localhost:2375 without TLS"**
4. Click **Apply & Restart**

#### Option B: Command Line (Alternative)
```bash
# Run a proxy container to expose Docker API
docker run -d \
  --name docker-api-proxy \
  -p 2375:2375 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  alpine/socat \
  TCP-LISTEN:2375,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock
```

### Step 2: Verify Docker API Access

Test that the Docker API is accessible:

```bash
# Test Docker API connectivity
curl http://localhost:2375/version

# Should return Docker version information
```

## 🔧 CORS Proxy Setup

### Why We Need a CORS Proxy

Modern browsers enforce **CORS (Cross-Origin Resource Sharing)** policies that prevent web applications from making direct requests to different ports. Since our React app runs on port 5173 and Docker API on port 2375, we need a proxy to handle CORS headers.

### Starting the CORS Proxy

The project includes a `cors-proxy.js` file that:

- **Proxies requests** from port 2376 to Docker API on port 2375
- **Adds CORS headers** to allow browser requests
- **Handles preflight requests** (OPTIONS)
- **Provides error handling** for connection issues

```bash
# Start the CORS proxy
node cors-proxy.js

# You should see: "CORS proxy server running on port 2376"
```

### Proxy Configuration

The proxy is configured to:
- **Listen on port 2376** (to avoid conflicts with Docker API on 2375)
- **Forward all requests** to `localhost:2375`
- **Add CORS headers** for all responses
- **Handle OPTIONS requests** for preflight checks

## 🚀 Application Setup

### Prerequisites

- Node.js 18+ and npm
- Docker Desktop running with API exposed
- CORS proxy running

### Installation Steps

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd mock-ecs-ui

# 2. Install dependencies
npm install

# 3. Start the CORS proxy (in a separate terminal)
node cors-proxy.js

# 4. Start the development server
npm run dev
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## 🔄 How This Maps to AWS ECS

### ECS Concepts → Docker Equivalents

| AWS ECS Concept | Docker Equivalent | Description |
|-----------------|-------------------|--------------|
| **Task** | Container | Individual container instance |
| **Task Definition** | Container Spec | Container configuration template |
| **Service** | Container Management | Container lifecycle management |
| **Cluster** | Docker Host | Container runtime environment |
| **Load Balancer** | Docker Network | Traffic distribution |
| **Auto Scaling** | Manual Scaling | Dynamic container management |

### Feature Mapping

#### 1. **Container Management** → **ECS Task Management**
- **Start/Stop containers** = Start/Stop ECS tasks
- **Container status** = Task status (RUNNING, STOPPED, etc.)
- **Resource monitoring** = ECS task resource usage

#### 2. **Container Orchestration** → **ECS Service Management**
- **Container lifecycle** = ECS task lifecycle management
- **Resource monitoring** = ECS task resource monitoring
- **Health monitoring** = ECS health check monitoring

#### 3. **Container Scaling** → **ECS Auto Scaling**
- **Manual scaling** = ECS service scaling
- **Load balancing** = ECS load balancer configuration
- **Resource allocation** = ECS task resource allocation

### Real-World ECS Workflow Simulation

1. **Deploy Containers** → Deploy ECS tasks
2. **Manage Container Lifecycle** → Manage ECS task lifecycle
3. **Monitor Resources** → Monitor ECS task resources
4. **Scale Containers** → Scale ECS services
5. **Health Monitoring** → Monitor ECS task health

## 🛠️ Technologies Used

### Frontend Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Query** - Data fetching and caching

### Backend Integration
- **Docker API** - Container management
- **CORS Proxy** - Cross-origin request handling

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

## 📱 Application Features

### Dashboard
- **Container overview** with metrics
- **System resource monitoring**
- **Real-time status updates**
- **Quick action buttons**

### Task Management
- **Container lifecycle management**
- **Start/Stop/Restart operations**
- **Resource usage monitoring**
- **Log viewing capabilities**

### Container Management
- **Container lifecycle operations**
- **Resource monitoring**
- **Health status tracking**
- **Performance metrics**

## 🔍 Troubleshooting

### Common Issues

#### Docker API Not Accessible
```bash
# Check if Docker API is running
curl http://localhost:2375/version

# If not accessible, enable in Docker Desktop settings
```

#### CORS Proxy Issues
```bash
# Check if proxy is running
curl http://localhost:2376/version

# Restart proxy if needed
node cors-proxy.js
```

#### Container Connection Issues
- Ensure Docker Desktop is running
- Verify API exposure on port 2375
- Check proxy is running on port 2376
- Verify no firewall blocking

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# Enable debug mode
DEBUG=true npm run dev
```

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```bash
# Build Docker image
docker build -t mock-ecs-ui .

# Run container
docker run -p 3000:3000 mock-ecs-ui
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Docker API Reference](https://docs.docker.com/engine/api/)
- [React Query Documentation](https://tanstack.com/query/latest)
