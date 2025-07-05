#!/bin/bash

# Docker Deployment Script for Marketing Post Generator MCP Server
# Handles deployment to various environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="marketing-post-generator-mcp"
VERSION=${VERSION:-"latest"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
COMPOSE_FILE=${COMPOSE_FILE:-"docker-compose.yml"}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-60}

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "docker-compose is not installed"
        exit 1
    fi
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to validate environment variables
validate_environment() {
    print_info "Validating environment configuration..."
    
    local required_vars=()
    local missing_vars=()
    
    # Define required variables based on environment
    case "$ENVIRONMENT" in
        "production")
            required_vars=("CLAUDE_API_KEY")
            ;;
        "staging")
            required_vars=("CLAUDE_API_KEY")
            ;;
        "development")
            # Development might not require all variables
            ;;
    esac
    
    # Check for missing required variables
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        print_info "Please set these variables before deployment"
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Function to pull latest images
pull_images() {
    print_info "Pulling latest images..."
    
    if docker-compose -f "$COMPOSE_FILE" pull; then
        print_success "Images pulled successfully"
    else
        print_warning "Failed to pull some images (will build locally)"
    fi
}

# Function to deploy services
deploy_services() {
    print_info "Deploying services..."
    
    # Stop existing services
    print_info "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # Start services
    print_info "Starting services..."
    if docker-compose -f "$COMPOSE_FILE" up -d; then
        print_success "Services started successfully"
    else
        print_error "Failed to start services"
        exit 1
    fi
}

# Function to wait for health check
wait_for_health_check() {
    local service_name="$1"
    local timeout="$2"
    
    print_info "Waiting for health check: $service_name (timeout: ${timeout}s)"
    
    local elapsed=0
    local interval=5
    
    while [ $elapsed -lt "$timeout" ]; do
        if docker-compose -f "$COMPOSE_FILE" ps "$service_name" | grep -q "healthy"; then
            print_success "Health check passed for: $service_name"
            return 0
        elif docker-compose -f "$COMPOSE_FILE" ps "$service_name" | grep -q "unhealthy"; then
            print_error "Health check failed for: $service_name"
            return 1
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo ""
    print_error "Health check timeout for: $service_name"
    return 1
}

# Function to verify deployment
verify_deployment() {
    print_info "Verifying deployment..."
    
    # Check service status
    print_info "Service status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    # Wait for main service health check
    if ! wait_for_health_check "marketing-post-generator" "$HEALTH_CHECK_TIMEOUT"; then
        print_error "Deployment verification failed"
        show_logs
        exit 1
    fi
    
    # Test API endpoint if in remote mode
    if [ "$ENVIRONMENT" != "development" ]; then
        local port=$(docker-compose -f "$COMPOSE_FILE" port marketing-post-generator 3000 2>/dev/null | cut -d: -f2)
        if [ -n "$port" ]; then
            print_info "Testing API endpoint on port $port..."
            if curl -f "http://localhost:$port/health" > /dev/null 2>&1; then
                print_success "API endpoint test passed"
            else
                print_warning "API endpoint test failed (this might be expected in local mode)"
            fi
        fi
    fi
    
    print_success "Deployment verification completed"
}

# Function to show logs
show_logs() {
    print_info "Recent logs:"
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
}

# Function to show deployment info
show_deployment_info() {
    print_info "Deployment Information:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Compose File: $COMPOSE_FILE"
    echo "  Image Version: $VERSION"
    echo ""
    
    print_info "Running Services:"
    docker-compose -f "$COMPOSE_FILE" ps --format table
    echo ""
    
    print_info "Available Endpoints:"
    local port=$(docker-compose -f "$COMPOSE_FILE" port marketing-post-generator 3000 2>/dev/null | cut -d: -f2)
    if [ -n "$port" ]; then
        echo "  Health Check: http://localhost:$port/health"
        echo "  MCP Endpoint: http://localhost:$port/mcp"
    else
        echo "  Local stdio mode (no HTTP endpoints)"
    fi
    echo ""
    
    print_info "Useful Commands:"
    echo "  View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Restart services: docker-compose -f $COMPOSE_FILE restart"
    echo "  Stop services: docker-compose -f $COMPOSE_FILE down"
    echo "  Scale services: docker-compose -f $COMPOSE_FILE up -d --scale marketing-post-generator=2"
}

# Function to rollback deployment
rollback() {
    print_warning "Rolling back deployment..."
    
    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down
    
    # You could implement more sophisticated rollback logic here
    # such as keeping track of previous image versions
    
    print_info "Rollback completed. Please redeploy with previous version."
}

# Main deployment function
deploy() {
    print_info "Starting deployment process..."
    print_info "Environment: $ENVIRONMENT"
    print_info "Compose File: $COMPOSE_FILE"
    print_info "Version: $VERSION"
    
    check_prerequisites
    validate_environment
    pull_images
    deploy_services
    verify_deployment
    show_deployment_info
    
    print_success "Deployment completed successfully!"
}

# Script usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy       Deploy the application (default)"
    echo "  rollback     Rollback the current deployment"
    echo "  status       Show deployment status"
    echo "  logs         Show application logs"
    echo "  help         Show this help message"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Target environment (production|staging|development) [default: production]"
    echo "  -f, --compose-file FILE  Docker compose file [default: docker-compose.yml]"
    echo "  -v, --version VERSION    Image version to deploy [default: latest]"
    echo "  -t, --timeout SECONDS    Health check timeout [default: 60]"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT              Same as --environment option"
    echo "  COMPOSE_FILE             Same as --compose-file option"
    echo "  VERSION                  Same as --version option"
    echo "  CLAUDE_API_KEY           Required for production/staging"
    echo "  HEALTH_CHECK_TIMEOUT     Same as --timeout option"
    echo ""
    echo "Examples:"
    echo "  $0                                      # Deploy to production with latest version"
    echo "  $0 deploy -e staging -v 1.2.3         # Deploy version 1.2.3 to staging"
    echo "  $0 status                              # Show current deployment status"
    echo "  $0 logs                                # Show application logs"
    echo "  $0 rollback                            # Rollback current deployment"
}

# Parse command line arguments
COMMAND="deploy"

# Parse command if provided
if [ $# -gt 0 ] && [[ "$1" != -* ]]; then
    COMMAND="$1"
    shift
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--compose-file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -t|--timeout)
            HEALTH_CHECK_TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Execute command
case "$COMMAND" in
    "deploy")
        deploy
        ;;
    "rollback")
        rollback
        ;;
    "status")
        print_info "Deployment Status:"
        docker-compose -f "$COMPOSE_FILE" ps
        ;;
    "logs")
        docker-compose -f "$COMPOSE_FILE" logs -f
        ;;
    "help")
        usage
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac