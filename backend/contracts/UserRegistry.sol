// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserRegistry {
    uint8 public constant ROLE_PUBLIC = 0;
    uint8 public constant ROLE_MAINTAINER = 1;
    uint8 public constant ROLE_ADMIN = 2;
    uint8 public constant ROLE_SUPER_ADMIN = 3;

    address public owner;

    mapping(address => uint8) private roles;
    mapping(address => bool) private active;

    event Registered(address indexed user, uint8 role);
    event RoleUpdated(address indexed user, uint8 role);
    event StatusUpdated(address indexed user, bool active);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyAdmin() {
        require(roles[msg.sender] >= ROLE_ADMIN, "Not authorized");
        _;
    }

    constructor(address superAdmin) {
        address initialOwner = superAdmin == address(0) ? msg.sender : superAdmin;
        owner = initialOwner;
        roles[initialOwner] = ROLE_SUPER_ADMIN;
        active[initialOwner] = true;
        emit Registered(initialOwner, ROLE_SUPER_ADMIN);
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Only owner");
        require(newOwner != address(0), "Invalid owner");
        address previous = owner;
        owner = newOwner;
        emit OwnerTransferred(previous, newOwner);
    }

    function register(address user, uint8 role) external onlyAdmin {
        require(user != address(0), "Invalid user");
        require(role <= ROLE_SUPER_ADMIN, "Invalid role");
        roles[user] = role;
        active[user] = true;
        emit Registered(user, role);
    }

    function setRole(address user, uint8 role) external onlyAdmin {
        require(user != address(0), "Invalid user");
        require(role <= ROLE_SUPER_ADMIN, "Invalid role");
        roles[user] = role;
        emit RoleUpdated(user, role);
    }

    function setActive(address user, bool isActive) external onlyAdmin {
        require(user != address(0), "Invalid user");
        active[user] = isActive;
        emit StatusUpdated(user, isActive);
    }

    function roleOf(address user) external view returns (uint8) {
        return roles[user];
    }

    function isActive(address user) external view returns (bool) {
        return active[user];
    }
}
