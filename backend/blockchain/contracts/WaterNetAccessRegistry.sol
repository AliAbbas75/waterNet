// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WaterNetAccessRegistry is Ownable {
    enum Role {
        Viewer,
        Maintainer,
        Administrator
    }

    mapping(address => bool) private _registered;
    mapping(address => Role) private _roleOf;

    event UserRegistered(address indexed user, Role role);
    event RoleChanged(address indexed user, Role oldRole, Role newRole);
    event UserRevoked(address indexed user);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function isRegistered(address user) external view returns (bool) {
        return _registered[user];
    }

    function roleOf(address user) external view returns (uint8) {
        require(_registered[user], "User not registered");
        return uint8(_roleOf[user]);
    }

    function registerUser(address user, Role role) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(!_registered[user], "Already registered");

        _registered[user] = true;
        _roleOf[user] = role;

        emit UserRegistered(user, role);
    }

    function setRole(address user, Role role) external onlyOwner {
        require(_registered[user], "User not registered");

        Role old = _roleOf[user];
        _roleOf[user] = role;

        emit RoleChanged(user, old, role);
    }

    function revokeUser(address user) external onlyOwner {
        require(_registered[user], "User not registered");

        _registered[user] = false;
        delete _roleOf[user];

        emit UserRevoked(user);
    }
}
